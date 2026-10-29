import { mkdir, rm, copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { ASSETS, APP_ID } from "./release-assets.mjs";
await rm("dist", { recursive: true, force: true });
const checksums = {};
for (const file of ASSETS) {
  const bytes = await readFile(file);
  checksums[file] = createHash("sha256").update(bytes).digest("hex");
  await mkdir(dirname(join("dist", file)), { recursive: true });
  await copyFile(file, join("dist", file));
}
const buildId = createHash("sha256")
  .update(JSON.stringify(checksums))
  .digest("hex")
  .slice(0, 16);
let commit = "uncommitted";
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {}
await writeFile(
  "dist/build-info.json",
  JSON.stringify(
    { app: APP_ID, version: "2.0.0", buildId, sourceCommit: commit, checksums },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "dist/precache.js",
  `self.CACHE_PREFIX=${JSON.stringify(APP_ID + "-")};self.BUILD_ID=${JSON.stringify(buildId)};self.ASSETS=${JSON.stringify(["./", ...ASSETS.map((p) => "./" + p), "./build-info.json"])};\n`,
);
console.log(
  `Built ${APP_ID} ${buildId}: ${ASSETS.length + 2} complete static assets.`,
);
