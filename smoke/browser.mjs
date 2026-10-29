/** Standalone Chromium regression smoke. npm install --no-save playwright@1.56.0 first. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";
const root = resolve("dist"),
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
          new URL(req.url, "http://local").pathname,
        ),
        path = resolve(
          root,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
      if (!path.startsWith(root + sep)) throw Error("outside root");
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".webmanifest": "application/manifest+json",
          }[extname(path)] || "text/plain",
      });
      res.end(await readFile(path));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const url = "http://127.0.0.1:" + server.address().port + "/";
  const command = async (text) => {
    await page.locator("#command").fill(text);
    await page.locator("#run-button").click();
    await page.waitForFunction(
      () => !document.querySelector("#run-button").disabled,
    );
  };
  await page.goto(url);
  await page.waitForSelector("#command");
  for (const id of [
    "containers",
    "layers",
    "filesystem",
    "images-containers",
  ]) {
    await page.locator(`[data-lesson="${id}"]`).click();
    for (
      let i = 0;
      i <
      { containers: 4, layers: 3, filesystem: 5, "images-containers": 6 }[id];
      i++
    ) {
      await page.locator("#lesson-load").click();
      await page.locator("#run-button").click();
      await page.waitForFunction(
        () => !document.querySelector("#run-button").disabled,
      );
    }
    assert.equal(
      await page.locator("#lesson-step-label").innerText(),
      "MISSION COMPLETE",
    );
  }
  await command("docker run -d --name web -p 8080:80 nginx");
  await command("docker exec web touch /tmp/keep");
  await command("docker stop web");
  await command("docker start web");
  await command("docker exec web ls /tmp");
  assert.match(await page.locator("#terminal-log").innerText(), /keep/);
  await command("docker run --name completed hello-world");
  await command("docker logs completed");
  assert.match(
    await page.locator("#terminal-log").innerText(),
    /Hello from Docker/,
  );
  await command("docker rmi nginx");
  assert.match(await page.locator("#terminal-log").innerText(), /referenced/);
  await command("docker run --name conflict -p 8080:80 nginx");
  assert.match(
    await page.locator("#terminal-log").innerText(),
    /already allocated/,
  );
  const count = await page.locator("#container-count").innerText();
  await page.reload();
  await page.waitForSelector("#command");
  assert.equal(await page.locator("#container-count").innerText(), count);
  assert.equal(
    await page
      .locator('[data-lesson="images-containers"]')
      .getAttribute("aria-selected"),
    "true",
  );
  await page.locator(".builder-panel summary").click();
  await page.locator("#build-button").click();
  await page.waitForFunction(
    () => !document.querySelector("#run-button").disabled,
  );
  await command("docker run --name built iris-app");
  assert.match(await page.locator("#container-shelf").innerText(), /built/);
  await command("docker history iris-app");
  assert.match(await page.locator("#terminal-log").innerText(), /metadata/);
  for (const width of [320, 360, 390, 412, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Viewport overflow " + width,
    );
  }
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/mobile-module1.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: four missions, stateful commands, reload, builder and six viewports; no uncaught browser errors.",
  );
} finally {
  await browser?.close();
  await new Promise((ok) => server.close(ok));
}
