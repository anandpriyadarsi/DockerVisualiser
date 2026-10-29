import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, runCommand } from "../src/simulator.js";
import { createExercise } from "../src/exercises.js";
import {
  emptyWorkspace,
  validateWorkspace,
  saveWorkspace,
} from "../src/storage.js";
const run = (s, c, o) => {
  const r = runCommand(s, c, o);
  assert.equal(r.ok, true, c + ": " + r.message);
  return r.state;
};
test("retagging the base name gives one tag owner and runs the new content", () => {
  let s = run(createInitialState(), "docker pull nginx");
  const old = s.images[0].id;
  s = run(s, "docker build -t nginx .", {
    dockerfile: "FROM nginx\nWORKDIR /app",
  });
  assert.equal(
    s.images.filter((i) => i.tags.includes("nginx:latest")).length,
    1,
  );
  s = run(s, "docker run nginx");
  assert.notEqual(s.containers[0].imageId, old);
  assert.equal(s.containers[0].cwd, "/app");
});
test("generated names remain unique and persistable after an explicit future default name", () => {
  let s = run(createInitialState(), "docker run --name practice-2 nginx");
  s = run(s, "docker run nginx");
  assert.equal(new Set(s.containers.map((c) => c.name)).size, 2);
  const w = emptyWorkspace();
  w.sandbox = s;
  const m = new Map();
  assert.equal(
    saveWorkspace(
      { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) },
      w,
    ).saved,
    true,
  );
});
test("derived images inherit immutable root profile and custom default command", () => {
  let s = run(createInitialState(), "docker build -t parent .", {
    dockerfile: "FROM nginx\nWORKDIR /app",
  });
  s = run(s, "docker build -t child .", {
    dockerfile: "FROM parent\nWORKDIR /child",
  });
  s = run(s, "docker run child");
  assert.equal(s.containers[0].status, "running");
  assert.match(s.containers[0].processes[0].name, /nginx/);
  s = run(s, "docker build -t custom-parent .", {
    dockerfile: 'FROM nginx\nCMD ["/bin/sh"]',
  });
  s = run(s, "docker build -t custom-child .", {
    dockerfile: "FROM custom-parent\nWORKDIR /data",
  });
  s = run(s, "docker run custom-child");
  assert.equal(s.containers.at(-1).status, "stopped");
  assert.equal(s.containers.at(-1).processes[0].name, "/bin/sh");
});
test("exercise backup validates every render-consumed field before replacement", () => {
  for (const mutate of [
    (e) => delete e.fixtureSummary,
    (e) => (e.id = "m01.other"),
    (e) => (e.progress.evidence = null),
    (e) => (e.progress.complete = "yes"),
    (e) => (e.fixtureSummary.containers = [{}]),
  ]) {
    const w = emptyWorkspace();
    const e = createExercise("m01.pull-nginx");
    mutate(e);
    w.exerciseSessions["m01.pull-nginx"] = e;
    assert.throws(() => validateWorkspace(w));
  }
});
test("finite sleeps receive explicit unsupported guidance and cannot create an immortal task", () => {
  const s = createInitialState(),
    r = runCommand(s, "docker run ubuntu sleep 1");
  assert.equal(r.ok, false);
  assert.strictEqual(r.state, s);
  assert.match(r.message, /sleep.*not yet simulated|not yet simulated.*sleep/i);
});
test("inspect exposes inherited command as immutable configuration, distinct from PID labels", () => {
  let s = run(createInitialState(), "docker build -t inherited .", {
    dockerfile: "FROM nginx\nWORKDIR /app",
  });
  s = run(s, "docker run --name web inherited");
  assert.deepEqual(
    JSON.parse(runCommand(s, "docker inspect web").message)[0].Config.Cmd,
    ["nginx", "-g", "daemon off;"],
  );
});
test("building beyond the durable workspace image bound fails atomically", () => {
  let s = createInitialState();
  for (let n = 0; n < 99; n++)
    s = run(s, "docker build -t image" + n + " .", {
      dockerfile: "FROM nginx\nRUN echo " + n,
    });
  assert.equal(s.images.length, 100);
  const r = runCommand(s, "docker build -t overflow .", {
    dockerfile: "FROM nginx\nRUN echo overflow",
  });
  assert.equal(r.ok, false);
  assert.strictEqual(r.state, s);
});
