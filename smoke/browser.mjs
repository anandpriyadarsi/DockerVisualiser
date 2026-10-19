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
  assert.equal(await page.locator('[data-lesson="containers"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#lesson-step-title').textContent(), 'Find an image');
  await page.locator('#lesson-load').click();
  assert.equal(await page.locator('#command').inputValue(), 'docker pull alpine');
  await page.locator('#run-button').click();
  await page.waitForFunction(() => document.querySelector('#lesson-step-title')?.textContent === 'Create a container');
  await page.locator('[data-lesson="layers"]').click();
  assert.equal(await page.locator('#lesson-step-title').textContent(), 'Build a tagged image');
  await page.locator('[data-lesson="filesystem"]').click();
  assert.equal(await page.locator('#lesson-step-title').textContent(), 'Start a fresh container');

  await page.locator('#build-button').click();
  await page.waitForFunction(() => document.querySelector('#image-count')?.textContent === '3');
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

  // Mentor acceptance: see an honest missing-registry error with no image/container.
  const mentorPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const mentorErrors = [];
  mentorPage.on('pageerror', error => mentorErrors.push(String(error)));
  await mentorPage.goto(url);
  await mentorPage.locator('#command').fill('docker run missing-image-for-mentor');
  await mentorPage.locator('#run-button').click();
  await mentorPage.waitForFunction(() => document.querySelector('#pull-status')?.textContent === 'IMAGE NOT FOUND');
  await mentorPage.waitForFunction(() => document.querySelector('#stage-message')?.dataset.state === 'error');
  assert.equal(await mentorPage.locator('#image-count').textContent(), '0');
  assert.equal(await mentorPage.locator('#container-count').textContent(), '0');
  assert.match(await mentorPage.locator('#terminal-log').textContent(), /not found in the OFFLINE simulated registry catalogue/);
  await mentorPage.screenshot({ path: 'artifacts/mentor-registry-missing.png', fullPage: true });

  // The layer tiles must be visible BEFORE the new image/container is committed.
  await mentorPage.locator('#command').fill('docker run nginx');
  await mentorPage.locator('#run-button').click();
  await mentorPage.waitForFunction(() => document.querySelectorAll('#pull-layers .pull-layer').length >= 1);
  assert.equal(await mentorPage.locator('#container-count').textContent(), '0');
  assert.equal(await mentorPage.locator('#image-count').textContent(), '0');
  await mentorPage.waitForFunction(() => document.querySelector('#pull-status')?.textContent === 'COMPLETE');
  assert.equal(await mentorPage.locator('#image-count').textContent(), '1');
  assert.equal(await mentorPage.locator('#container-count').textContent(), '1');
  assert.equal(await mentorPage.locator('#pull-layers .pull-layer').count(), 3);
  await mentorPage.screenshot({ path: 'artifacts/mentor-pull-complete.png', fullPage: true });

  await mentorPage.locator('#command').fill('docker run nginx');
  await mentorPage.locator('#run-button').click();
  await mentorPage.waitForFunction(() => document.querySelector('#container-count')?.textContent === '2');
  assert.match(await mentorPage.locator('#pull-target').textContent(), /already cached/);
  assert.equal(await mentorPage.locator('#pull-layers .pull-layer').count(), 0);
  assert.deepEqual(mentorErrors, []);

  assert.deepEqual(browserErrors, []);
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(url);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile horizontal overflow');
  await mobile.locator('#build-button').click();
  await mobile.waitForFunction(() => document.querySelector('#image-count')?.textContent === '2');
  await mobile.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  console.log('Browser smoke passed: V3 runtime and guided lessons; desktop/mobile responsive.');
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}
