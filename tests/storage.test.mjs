import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, runCommand } from "../src/simulator.js";
import { initialProgress } from "../src/lessons.js";
const api = await import("../src/storage.js").catch(() => ({}));
const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
test("reload restores pure sandbox missions drafts and bounded command history", () => {
  assert.equal(typeof api.saveWorkspace, "function");
  const s = memory();
  const workspace = {
    schemaVersion: 1,
    coreVersion: "2.0.0",
    sandbox: runCommand(createInitialState(), "docker run nginx").state,
    missionProgress: initialProgress(),
    exerciseSessions: {},
    editorDraft: "FROM nginx",
    commandHistory: ["docker run nginx"],
  };
  assert.equal(api.saveWorkspace(s, workspace).saved, true);
  assert.deepEqual(api.loadWorkspace(s).workspace, workspace);
});
test("storage denial remains usable and malformed states stay preserved", () => {
  assert.equal(typeof api.loadWorkspace, "function");
  assert.equal(
    api.loadWorkspace({
      getItem() {
        throw Error("denied");
      },
    }).saved,
    false,
  );
  const s = memory();
  s.setItem(api.KEY, "{bad");
  assert.equal(api.loadWorkspace(s).saved, false);
  assert.equal(s.getItem(api.KEY), "{bad");
});
test("imports reject broken references and runtime shapes", () => {
  assert.equal(typeof api.validateWorkspace, "function");
  assert.throws(() =>
    api.validateWorkspace({
      schemaVersion: 1,
      sandbox: { images: [], containers: [{ id: "a", imageId: "missing" }] },
    }),
  );
});
