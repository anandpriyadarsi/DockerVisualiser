import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { ASSETS, APP_ID } from "./release-assets.mjs";
const expected = [...ASSETS, "precache.js", "build-info.json"].sort(),
  actual = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.isFile()) actual.push(relative("dist", p).replaceAll("\\", "/"));
    else throw Error("Unexpected file entry");
  }
}
await walk("dist");
assert.deepEqual(
  actual.sort(),
  expected,
  "Artifact must contain exactly the reviewed assets",
);
const info = JSON.parse(await readFile("dist/build-info.json", "utf8"));
assert.equal(info.app, APP_ID);
let compressed = 0;
for (const f of ASSETS) {
  const bytes = await readFile("dist/" + f);
  assert.ok(bytes.length);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    info.checksums[f],
    f + " checksum",
  );
  if ([".html", ".css", ".js", ".json"].includes(extname(f))) {
    const text = bytes.toString();
    assert.doesNotMatch(
      text,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}/,
    );
    assert.doesNotMatch(
      text,
      /prismatic-lamington-67be56/,
      "Obsolete simulator URL",
    );
    if (f.endsWith(".js")) {
      compressed += gzipSync(bytes).length;
      const imports = [
        ...text.matchAll(/(?:from\s+|import\s*\(?\s*)['"](\.[^'"]+)['"]/g),
      ].map((m) => m[1]);
      for (const imported of imports) {
        const target = join("dist", f, "..", imported);
        await readFile(target);
      }
    }
  }
}
assert.ok(compressed <= 150 * 1024, "First-party JS compressed-size budget");
const html = await readFile("dist/index.html", "utf8");
assert.match(html, /type="module"/);
assert.match(html, /manifest.webmanifest/);
assert.match(
  await readFile("dist/_headers", "utf8"),
  /X-Frame-Options:\s*SAMEORIGIN/,
);
assert.match(await readFile("dist/sw.js", "utf8"), /precache.js/);
if (APP_ID === "docker-academy") {
  const pin = JSON.parse(
    await readFile("dist/vendor/simulator/pin.json", "utf8"),
  );
  for (const [f, hash] of Object.entries(pin.files))
    assert.equal(
      createHash("sha256")
        .update(await readFile("dist/vendor/simulator/" + f))
        .digest("hex"),
      hash,
      "Pinned simulator " + f,
    );
}
console.log(
  `PASS ${APP_ID}: ${expected.length} exact assets, imports/checksums verified, first-party JS gzip sum ${compressed} bytes.`,
);
