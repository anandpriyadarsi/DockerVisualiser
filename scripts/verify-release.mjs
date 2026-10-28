/** Verify the exact public static artifact before it is uploaded to hosting. */
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, extname } from 'node:path';

const root = resolve('dist');
const expected = new Set([
  'index.html', '_headers',
  'src/app.js', 'src/simulator.js', 'src/filesystem.js',
  'src/lessons.js', 'src/style.css', 'docs/ROADMAP.md'
]);
const found = new Set();
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) found.add(relative(root, full).replaceAll('\\', '/'));
    else throw Error('Unexpected deployment entry: ' + full);
  }
}
await walk(root);
assert.deepEqual([...found].sort(), [...expected].sort(), 'Only reviewed public assets may be deployed');
const html = await readFile(join(root, 'index.html'), 'utf8');
assert.match(html, /src\/app\.js/);
assert.match(html, /src\/style\.css/);
assert.match(html, /DockerVisualiser/);
const headers = await readFile(join(root, '_headers'), 'utf8');
assert.match(headers, /X-Frame-Options:\s*SAMEORIGIN/i, 'Same-origin Academy embeds are supported');
assert.doesNotMatch(headers, /X-Frame-Options:\s*DENY/i, 'DENY would block the integrated course simulator');
for (const file of expected) {
  const full = join(root, file);
  assert.ok((await stat(full)).size > 0, 'Empty deploy asset: ' + file);
  if (['.html', '.css', '.js'].includes(extname(file))) {
    const content = await readFile(full, 'utf8');
    assert.doesNotMatch(content, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
    assert.doesNotMatch(content, /gh[pousr]_[A-Za-z0-9]{30,}/);
  }
}
console.log('PASS: public dist/ contains exactly eight reviewed assets, expected entry points, no detected private-key signatures.');
