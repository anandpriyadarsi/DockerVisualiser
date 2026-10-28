/** Produce an intentionally small static deploy folder: no tests, git files, or credentials. */
import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
const files = [
  'index.html', 'src/app.js', 'src/simulator.js', 'src/filesystem.js',
  'src/lessons.js', 'src/style.css', 'docs/ROADMAP.md'
];
await rm('dist', { recursive: true, force: true });
for (const file of files) {
  const target = join('dist', file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}
await writeFile('dist/_headers', `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: SAMEORIGIN\n`);
console.log('Built dist/ for static hosting (HTML, JS, CSS and roadmap only).');
