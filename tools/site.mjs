// Assembles the public website into _site/ (or the folder given as the first argument):
//   /            web/ (landing pages, privacy policy, 404)
//   /demo/       the console with its built-in simulator
//   /fonts/, /css/fonts.css   the typefaces, shared by both
// Run `node desktop/scripts/fonts.mjs` first so console/fonts exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, '_site'));
const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
copy('console', 'demo');
copy('web', '.');
if (fs.existsSync(path.join(root, 'console', 'fonts'))) {
  copy('console/fonts', 'fonts');
  fs.mkdirSync(path.join(out, 'css'), { recursive: true });
  fs.copyFileSync(path.join(root, 'console', 'css', 'fonts.css'), path.join(out, 'css', 'fonts.css'));
} else {
  console.warn('site: console/fonts is missing, so pages fall back to system fonts');
}

let files = 0, bytes = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; }
  }
})(out);
console.log(`site: ${files} files, ${(bytes / 1048576).toFixed(1)} MB in ${path.relative(root, out) || '.'}`);
