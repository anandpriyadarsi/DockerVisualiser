/** Browser acceptance smoke test; run in CI after installing Playwright Chromium. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.md': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (file !== root && !file.startsWith(root + sep)) throw Error('outside static root');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  await mkdir('artifacts', { recursive: true });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(String(error)));
  await page.goto(url);
  await page.locator('#build-button').click();
  await page.waitForFunction(() => document.querySelector('#image-count')?.textContent === '2');
  assert.equal(await page.locator('.layer-brick').count(), 7);
  await page.locator('#build-button').click();
  await page.waitForFunction(() => document.querySelector('#terminal-log')?.textContent.includes('4 reused from cache'));
  await page.locator('#command').fill('docker run iris-app');
  await page.locator('#run-button').click();
  await page.waitForFunction(() => document.querySelector('#container-count')?.textContent === '1');
  assert.equal(await page.locator('.container-card.running').count(), 1);
  await page.locator('[data-runtime="mkdir /tmp/work"]').click();
  await page.waitForFunction(() => document.querySelector('#filesystem-tree')?.textContent.includes('/tmp/work/'));
  await page.locator('[data-runtime="touch /tmp/note.txt"]').click();
  await page.waitForFunction(() => document.querySelector('#filesystem-tree')?.textContent.includes('/tmp/note.txt'));
  await page.locator('[data-runtime="write /tmp/note.txt hello from NITK"]').click();
  await page.waitForFunction(() => document.querySelector('#terminal-log')?.textContent.includes('Wrote /tmp/note.txt'));
  await page.locator('[data-runtime="ps"]').click();
  await page.waitForFunction(() => document.querySelector('#process-list')?.textContent.includes('node'));
  assert.ok(await page.locator('.process-row').count() >= 2);
  await page.locator('#command').fill('docker stop c001');
  await page.locator('#run-button').click();
  await page.waitForFunction(() => document.querySelector('#container-shelf')?.textContent.includes('stopped'));
  assert.equal(await page.locator('[data-runtime="ps"]').isDisabled(), true);

  assert.deepEqual(browserErrors, []);
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(url);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile horizontal overflow');
  await mobile.locator('#build-button').click();
  await mobile.waitForFunction(() => document.querySelector('#image-count')?.textContent === '2');
  await mobile.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  console.log('Browser smoke passed: V3 desktop filesystem/process/stop; mobile layout and build.');
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}