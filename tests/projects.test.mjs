// Project lab: the project files are valid, and the app and website copies are up to date.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load, outputs, root, renderPage, VIEWS } from '../tools/projects.mjs';

test('T-PRJ-001 every project is complete in Korean and English and points at real screens and parts', () => {
  const { projects, parts } = load();
  assert.ok(projects.length >= 6);
  assert.deepEqual(projects.map(p => p.order), [...projects.map(p => p.order)].sort((a, b) => a - b));
  for (const p of projects) {
    assert.equal(p.status, 'OPERATOR_REQUIRED', `${p.id}: nothing is marked verified on hardware without evidence`);
    for (const s of p.steps) if (s.view) assert.ok(VIEWS.includes(s.view));
    for (const id of p.parts) assert.ok(parts[id], id);
  }
});

test('T-PRJ-002 the app data and both website pages match the project files', () => {
  // Git on Windows may check text files out with CRLF line endings; the content is what matters.
  const lf = s => s.replace(/\r\n/g, '\n');
  for (const [rel, body] of Object.entries(outputs())) assert.equal(lf(fs.readFileSync(path.join(root, rel), 'utf8')), body, `${rel} is out of date: run node tools/projects.mjs`);
});

test('T-PRJ-003 a broken project file is refused with its name and the reason', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wavrel-projects-'));
  const src = path.join(root, 'projects');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.json')) fs.copyFileSync(path.join(src, f), path.join(tmp, f));
  const file = path.join(tmp, '01-wifi-motion.json'), good = fs.readFileSync(file, 'utf8');
  const bad = (change, re) => { const p = JSON.parse(good); change(p); fs.writeFileSync(file, JSON.stringify(p)); assert.throws(() => load(tmp), re); fs.writeFileSync(file, good); };
  bad(p => { p.status = 'HARDWARE_VERIFIED'; }, /01-wifi-motion.json: HARDWARE_VERIFIED needs an evidence id/);
  bad(p => { p.steps[0].view = 'settings'; }, /step view must be one of/);
  bad(p => { p.parts.push('flux-capacitor'); }, /parts must name entries/);
  bad(p => { p.firmware[0].url = 'http://espectre.dev/'; }, /https URL/);
  bad(p => { p.title.en = '<b>x</b>'; }, /title needs ko and en/);
  bad(p => { p.learn.en.pop(); }, /learn needs matching/);
  assert.equal(load(tmp).projects.length, load().projects.length);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('T-PRJ-004 the website pages are static, linked both ways and escape what they show', () => {
  const data = load();
  for (const lang of ['ko', 'en']) {
    const html = renderPage(data, lang);
    assert.ok(!/<script/i.test(html), 'no scripts on the page');
    assert.match(html, /hreflang="ko" href="https:\/\/wavrel.com\/projects\/"/);
    assert.match(html, /hreflang="en" href="https:\/\/wavrel.com\/en\/projects\/"/);
    for (const p of data.projects) assert.ok(html.includes(`id="${p.id}"`));
  }
  const odd = { projects: [{ ...data.projects[0], title: { ko: 'A & B', en: 'A & B' } }], parts: data.parts };
  assert.ok(renderPage(odd, 'en').includes('A &amp; B'));
});

test('T-PRJ-005 a project setup may only turn on known rules and switches', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wavrel-projects-'));
  const src = path.join(root, 'projects');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.json')) fs.copyFileSync(path.join(src, f), path.join(tmp, f));
  const file = path.join(tmp, '07-led-status.json'), good = fs.readFileSync(file, 'utf8');
  const bad = (change, re) => { const p = JSON.parse(good); change(p); fs.writeFileSync(file, JSON.stringify(p)); assert.throws(() => load(tmp), re); fs.writeFileSync(file, good); };
  bad(p => { p.setup.rules[0].then = { t: 'publish', topic: 'x', payload: 'y' }; }, /then.t must be one of/);
  bad(p => { p.setup.rules[0].then.color = 'red'; }, /#rrggbb/);
  bad(p => { p.setup.rules[0].when = { t: 'enter', room: '*' }; }, /needs a node .* or a room/);
  bad(p => { p.setup.models = { glass: false }; }, /may only turn on/);
  bad(p => { p.setup.delete = ['r1']; }, /unknown key delete/);
  bad(p => { p.setup.open = 'settings'; }, /setup.open must be a screen/);
  assert.ok(load(tmp).projects.every(p => p.setup));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('T-PRJ-006 a project is marked checked on hardware only with a passing record from a real board', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wavrel-projects-')), proj = path.join(tmp, 'projects'), ev = path.join(tmp, 'evidence');
  fs.mkdirSync(proj); fs.mkdirSync(ev);
  const src = path.join(root, 'projects');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.json')) fs.copyFileSync(path.join(src, f), path.join(proj, f));
  const file = path.join(proj, '01-wifi-motion.json'), p = JSON.parse(fs.readFileSync(file, 'utf8'));
  p.status = 'HARDWARE_VERIFIED'; p.evidence = 'EVD-20261201-wifi-motion';
  fs.writeFileSync(file, JSON.stringify(p));
  const rec = { v: 1, id: p.evidence, project: 'wifi-motion', date: '2026-12-01', app: '0.6.1', source: 'live',
    criteria: p.success.ko.map((ko, i) => ({ ko, en: p.success.en[i], result: 'pass' })), parts: ['esp32-s3'], session: { labels: 5, hits: 5, misses: 0, falses: 0, minutes: 3 }, note: 'living room, 3 m' };
  const evFile = path.join(ev, `${p.evidence}.json`);
  const withEv = (change, re) => { const r = JSON.parse(JSON.stringify(rec)); change(r); fs.writeFileSync(evFile, JSON.stringify(r)); if (re) assert.throws(() => load(proj, ev), re); else return load(proj, ev); };
  assert.throws(() => load(proj, ev), /evidence\/EVD-20261201-wifi-motion.json is missing/);
  const ok = withEv(() => {});
  assert.equal(ok.projects[0].verified, '2026-12-01');
  assert.match(renderPage(ok, 'ko'), /실기 검증됨 · 2026-12-01/);
  withEv(r => { r.source = 'demo'; }, /real board, not the simulator/);
  withEv(r => { r.criteria[1].result = 'skip'; }, /every success criterion must have passed/);
  withEv(r => { r.project = 'ble-rooms'; }, /another project/);
  withEv(r => { r.note = 'router at 192.168.0.1'; }, /must not hold addresses/);
  withEv(r => { r.note = 'tag aa:bb:cc:dd:ee:ff'; }, /must not hold addresses/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
