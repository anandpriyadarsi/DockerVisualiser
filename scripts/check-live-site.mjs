/**
 * Read-only verification of a deployed DockerVisualiser static site.
 * No credentials or shell commands are sent to the target site.
 * Usage: node scripts/check-live-site.mjs https://your-site.netlify.app
 */
import assert from "node:assert/strict";

const argument = process.argv[2];
if (!argument) {
  console.error("Usage: npm run check:live -- https://your-site.netlify.app");
  process.exit(2);
}
let base;
try {
  base = new URL(argument);
  assert.equal(base.protocol, "https:", "A public HTTPS URL is required");
  assert.equal(base.username, "");
  assert.equal(base.password, "");
  assert.equal(base.search, "");
  assert.equal(base.hash, "");
  assert.equal(base.pathname, "/");
} catch (error) {
  console.error("Invalid public site URL:", error.message);
  process.exit(2);
}

const assets = [
  {
    path: "/",
    type: "text/html",
    includes: ["DockerVisualiser", "./src/style.css", "./src/app.js"],
  },
  {
    path: "/src/style.css",
    type: "text/css",
    includes: [".shell", ".terminal-panel"],
  },
  {
    path: "/src/app.js",
    type: "javascript",
    includes: ["./simulator.js", "renderRuntime"],
  },
  {
    path: "/src/simulator.js",
    type: "javascript",
    includes: ["createInitialState", "runCommand"],
  },
  { path: "/src/filesystem.js", type: "javascript", includes: ["filesystem"] },
  { path: "/src/lessons.js", type: "javascript", includes: ["LESSONS"] },
];
let failed = 0;
for (const asset of assets) {
  const url = new URL(asset.path, base);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "*/*" },
    });
    const type = res.headers.get("content-type") || "";
    assert.equal(res.status, 200, "expected HTTP 200, got " + res.status);
    assert.ok(
      type.toLowerCase().includes(asset.type),
      "unexpected content type: " + type,
    );
    assert.equal(
      res.url.startsWith(base.origin + "/"),
      true,
      "redirected to another website",
    );
    const body = await res.text();
    for (const expected of asset.includes) {
      assert.ok(
        body.includes(expected),
        "expected marker missing: " + expected,
      );
    }
    console.log("PASS", url.pathname, "(" + body.length + " characters)");
  } catch (error) {
    failed += 1;
    console.error("FAIL", url.pathname, error.message);
  }
}
if (failed) {
  console.error(
    "Live acceptance FAILED:",
    failed,
    "asset(s). Verify Netlify Public access and the src/ directory structure.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "Live static asset acceptance PASSED. Also test commands manually and confirm anonymous/incognito access.",
  );
}
