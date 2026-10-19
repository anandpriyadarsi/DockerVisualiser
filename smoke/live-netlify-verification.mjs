/**
 * Read-only external acceptance of the ACTUAL Netlify deployment.
 * This test does not execute Docker or modify any GitHub/Netlify resources.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = 'https://prismatic-lamington-67be56.netlify.app/';
const browser = await chromium.launch({ headless: true });
await mkdir('artifacts/live', { recursive: true });

async function submit(page, command) {
  await page.locator('#command').fill(command);
  await page.locator('#run-button').click();
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(response?.status(), 200);
  const panel = page.locator('#pull-visualizer');
  assert.equal(await panel.count(), 1, 'Updated pull visualization panel is missing on LIVE Netlify site');
  assert.equal(await page.locator('#image-count').textContent(), '0');

  // First run must show each layer BEFORE the image/container is created.
  await submit(page, 'docker run nginx');
  await page.waitForFunction(() => document.querySelectorAll('#pull-layers .pull-layer').length >= 1,
    { timeout: 18000 });
  assert.equal(await page.locator('#container-count').textContent(), '0',
    'Container became visible before pull animation completed');
  await page.waitForFunction(() => document.querySelector('#pull-status')?.textContent === 'COMPLETE',
    { timeout: 25000 });
  assert.equal(await page.locator('#image-count').textContent(), '1');
  assert.equal(await page.locator('#container-count').textContent(), '1');
  assert.equal(await page.locator('#pull-layers .pull-layer').count(), 3);
  await page.screenshot({ path: 'artifacts/live/01-pull-complete.png', fullPage: true });
  console.log('PASS: actual deployment shows image pull stages before container creation');

  // Reuse must not simulate a fresh download.
  await submit(page, 'docker run nginx');
  await page.waitForFunction(() => document.querySelector('#container-count')?.textContent === '2', { timeout: 15000 });
  assert.equal(await page.locator('#image-count').textContent(), '1');
  assert.equal(await page.locator('#pull-layers .pull-layer').count(), 0);
  assert.match(await page.locator('#pull-target').textContent(), /already cached/);
  await page.screenshot({ path: 'artifacts/live/02-local-cache.png', fullPage: true });
  console.log('PASS: actual deployment reuses cached image');

  // A missing simulated registry entry must produce an error atomically.
  await page.locator('#reset-button').click();
  await submit(page, 'docker run missing-nitk-2026');
  await page.waitForFunction(() => document.querySelector('#pull-status')?.textContent === 'IMAGE NOT FOUND', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#stage-message')?.dataset.state === 'error', { timeout: 15000 });
  assert.equal(await page.locator('#image-count').textContent(), '0');
  assert.equal(await page.locator('#container-count').textContent(), '0');
  assert.match(await page.locator('#terminal-log').textContent(), /not found in the OFFLINE simulated registry catalogue/);
  await page.screenshot({ path: 'artifacts/live/03-registry-error.png', fullPage: true });
  console.log('PASS: actual deployment rejects absent simulated-registry images');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(await mobile.locator('#pull-visualizer').count(), 1);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
    'Updated live deployment overflows the phone viewport');
  await mobile.screenshot({ path: 'artifacts/live/04-mobile.png', fullPage: true });
  assert.deepEqual(pageErrors, []);
  console.log('PASS: live desktop/mobile deployment checks');
} finally {
  await browser.close();
}
