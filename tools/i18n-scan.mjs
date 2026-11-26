// Finds every Korean UI string in the console and checks it against the English dictionary.
//   node tools/i18n-scan.mjs            report missing translations and untagged strings (exit 1 if any)
//   node tools/i18n-scan.mjs --wrap     tag untagged Korean literals with L (one-off helper)
//   node tools/i18n-scan.mjs --keys     print every key as JSON
//   node tools/i18n-scan.mjs --push     move the L tag from templates that hold markup down to their text (one-off helper)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'console');
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const JS = ['core.js', 'sim.js', 'space.js', 'views.js', 'report.js', 'glass.js', 'models.js', 'remote.js', 'projects.js', 'desktop.js', 'app.js'];
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'data-title', 'value', 'content'];

export const norm = s => s.replace(/\s+/g, ' ').trim();
export const templateKey = quasis => quasis.reduce((a, q, i) => a + (i ? '{' + (i - 1) + '}' : '') + q, '');

/* Walks the syntax tree and reports Korean string and template literals: tagged (already translatable) or not. */
export function scanJs(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const tagged = [], untagged = [], odd = [], kept = [];
  (function walk(n, parent, key) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'TemplateLiteral') {
      const cooked = n.quasis.map(q => q.value.cooked);
      if (cooked.some(c => HANGUL.test(c))) {
        const isTagged = parent.type === 'TaggedTemplateExpression' && parent.tag.type === 'Identifier' && parent.tag.name === 'L';
        (isTagged ? tagged : untagged).push({ key: templateKey(cooked), start: n.start, end: n.end, kind: 'template' });
      }
    } else if (n.type === 'Literal' && typeof n.value === 'string' && HANGUL.test(n.value)) {
      const call = parent.type === 'CallExpression' && parent.callee.type === 'Identifier' && parent.callee.name === 'L' && parent.arguments[0] === n;
      if (call) tagged.push({ key: n.value, start: n.start, end: n.end, kind: 'string' });
      else {
        const item = { key: n.value, start: n.start, end: n.end, kind: 'string' };
        const logic = (parent.type === 'BinaryExpression' && /^[!=]==?$/.test(parent.operator)) || parent.type === 'SwitchCase' || (parent.type === 'Property' && key === 'key' && !parent.computed) ||
          (parent.type === 'MemberExpression' && key === 'property') ||
          (parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && /^(includes|startsWith|endsWith|indexOf|test|match|split)$/.test(parent.callee.property.name || ''));
        // { ko: '…', en: '…' }: text kept in both languages on purpose, such as a model's instructions
        const both = parent.type === 'Property' && key === 'value' && !parent.computed && parent.key && (parent.key.name === 'ko' || parent.key.value === 'ko');
        (both ? kept : logic ? odd : untagged).push(item);
      }
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k)); else if (v && typeof v.type === 'string') walk(v, n, k);
    }
  })(ast, { type: 'Root' }, null);
  return { tagged, untagged, odd, kept };
}

/* Static text and attributes in index.html. Scripts and styles are skipped. */
export function scanHtml(html) {
  const keys = new Set();
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of body.matchAll(/>([^<]+)</g)) { const t = norm(decode(m[1])); if (HANGUL.test(t)) keys.add(t); }
  for (const m of body.matchAll(/\s([a-z-]+)="([^"]*)"/gi)) if (ATTRS.includes(m[1].toLowerCase())) { const t = norm(decode(m[2])); if (HANGUL.test(t)) keys.add(t); }
  return [...keys];
}
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&rarr;/g, '→').replace(/&hellip;/g, '…');

export function dictionary() {
  const ctx = { window: {} }; vm.createContext(ctx);
  const file = path.join(root, 'js', 'i18n-en.js');
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return ctx.window.I18N_EN || {};
}

/* A translation must keep the placeholders and the markup of its source, or the page would break. */
export function shapeProblems(key, en) {
  const ph = s => (s.match(/\{\d+\}/g) || []).sort().join();
  const tags = s => (s.match(/<[^>]+>/g) || []).map(t => t.replace(/\b(aria-label|title|alt|placeholder)="[^"]*"/g, '$1')).sort().join();   // these attributes hold text, so their values may differ
  const out = [];
  if (ph(key) !== ph(en)) out.push('placeholders differ');
  if (tags(key) !== tags(en)) out.push('markup differs');
  if (HANGUL.test(en)) out.push('Korean left in the translation');
  return out;
}

/* For a tagged template that holds markup, returns the edits that tag only its text runs and attribute values,
   so that translations never have to repeat tags or styles. ${...} parts count as one opaque character. */
export function pushDown(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }), ops = [];
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'TaggedTemplateExpression' && n.tag.type === 'Identifier' && n.tag.name === 'L' && n.quasi.quasis.some(q => /<[a-zA-Z\/!]/.test(q.value.raw))) {
      const qs = n.quasi.quasis, runs = []; let inTag = false, quote = null, run = { first: null, last: null, has: false };
      const close = () => { if (run.has) runs.push(run); run = { first: null, last: null, has: false }; };
      const mark = (a, b, text) => { if (run.first === null) run.first = a; run.last = b; if (text && HANGUL.test(text)) run.has = true; };
      qs.forEach((q, i) => {
        for (let p = q.start; p < q.end; p++) {
          const c = src[p];
          if (c === '\\' && src[p + 1] === 'n') { p++; continue; }
          if (!inTag) { if (c === '<' && /[a-zA-Z\/!]/.test(src[p + 1] || '')) { close(); inTag = true; } else if (!/\s/.test(c)) mark(p, p + 1, c); }
          else if (quote) { if (c === quote) { close(); quote = null; } else if (!/\s/.test(c)) mark(p, p + 1, c); }
          else if (c === '"' || c === "'") { quote = c; run = { first: null, last: null, has: false }; }
          else if (c === '>') { inTag = false; run = { first: null, last: null, has: false }; }
        }
        if (i < qs.length - 1 && (!inTag || quote)) mark(q.end, qs[i + 1].start);
      });
      close();
      ops.push([n.tag.start, n.tag.end - n.tag.start, '']);
      for (const r of runs) { ops.push([r.first, 0, '${L`']); ops.push([r.last, 0, '`}']); }
    }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  return ops;
}

export function scanAll() {
  const perFile = {}, keys = new Map();
  for (const f of JS) { const r = scanJs(fs.readFileSync(path.join(root, 'js', f), 'utf8')); perFile[f] = r; for (const t of r.tagged) keys.set(t.key, f); }
  for (const k of scanHtml(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) if (!keys.has(k)) keys.set(k, 'index.html');
  return { perFile, keys };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === '--push') {
    for (const f of JS) {
      const file = path.join(root, 'js', f); let src = fs.readFileSync(file, 'utf8'); let n = 0;
      for (let pass = 0; pass < 6; pass++) {                                            // nested templates: one level per pass
        const ops = pushDown(src); if (!ops.length) break; n += ops.filter(o => o[1]).length;
        for (const [pos, del, ins] of ops.sort((a, b) => b[0] - a[0] || (a[2] === '`}' ? 1 : -1))) src = src.slice(0, pos) + ins + src.slice(pos + del);
      }
      fs.writeFileSync(file, src); if (n) console.log(f, 'templates split', n);
    }
  } else if (mode === '--wrap') {
    for (const f of JS) {
      const file = path.join(root, 'js', f); let src = fs.readFileSync(file, 'utf8');
      const { untagged } = scanJs(src);
      for (const u of untagged.sort((a, b) => b.start - a.start)) src = u.kind === 'template' ? src.slice(0, u.start) + 'L' + src.slice(u.start) : src.slice(0, u.start) + 'L(' + src.slice(u.start, u.end) + ')' + src.slice(u.end);
      fs.writeFileSync(file, src); console.log(f, 'tagged', untagged.length);
    }
  } else {
    const { perFile, keys } = scanAll(), en = dictionary();
    if (mode === '--keys') { console.log(JSON.stringify(Object.fromEntries([...keys].map(([k, f]) => [k, en[k] ?? null])), null, 0)); process.exit(0); }
    let bad = 0;
    for (const [f, r] of Object.entries(perFile)) { for (const u of r.untagged) { bad++; console.log(`untagged  ${f}: ${u.key.slice(0, 90)}`); } for (const o of r.odd) console.log(`logic     ${f}: ${o.key.slice(0, 90)}`); }
    for (const [k, f] of keys) { if (!(k in en)) { bad++; console.log(`missing   ${f}: ${k.slice(0, 110)}`); } else for (const p of shapeProblems(k, en[k])) { bad++; console.log(`${p}  ${f}: ${k.slice(0, 90)}`); } }
    for (const k of Object.keys(en)) if (!keys.has(k)) console.log(`unused    ${k.slice(0, 90)}`);
    console.log(`${keys.size} keys, ${bad} problems`); process.exit(bad ? 1 : 0);
  }
}
