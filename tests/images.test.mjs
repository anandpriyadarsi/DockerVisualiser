import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  parseDockerfile,
  runCommand,
} from "../src/simulator.js";
const dockerfile = `# Example learning build
FROM ubuntu
WORKDIR /app
COPY app.js /app/
RUN echo ready
CMD ["node", "app.js"]`;
const run = (state, command, file = dockerfile) =>
  runCommand(state, command, { dockerfile: file });

test("Dockerfile parser preserves order and skips comments/blank lines", () => {
  const parsed = parseDockerfile(dockerfile);
  assert.deepEqual(
    parsed.map((p) => p.op),
    ["FROM", "WORKDIR", "COPY", "RUN", "CMD"],
  );
  assert.equal(parsed[0].line, 2);
});

test("build creates base image and custom layers in correct order", () => {
  const result = run(createInitialState(), "docker build -t campus-app .");
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(
    result.state.images.map((image) => image.name),
    ["ubuntu", "campus-app"],
  );
  const built = result.state.images[1];
  assert.equal(built.layers.length, 6);
  assert.deepEqual(
    built.layers.slice(3).map((l) => l.instruction),
    ["WORKDIR /app", "COPY app.js /app/", "RUN echo ready"],
  );
});

test("image reuse is deterministic and rebuilding same image produces cache hits", () => {
  const first = run(createInitialState(), "docker build -t campus-app .");
  const second = run(first.state, "docker build -t campus-app .");
  assert.equal(second.ok, true);
  assert.match(second.message, /4 reused from cache/);
  assert.deepEqual(
    first.state.images[1].layers.map((l) => l.id),
    second.state.images[1].layers.map((l) => l.id),
  );
  assert.equal(
    second.state.images.filter((i) => i.name === "campus-app").length,
    1,
  );
});

test("changing an early instruction changes dependent layer ids but preserves base ids", () => {
  let state = run(createInitialState(), "docker build -t v1 .").state;
  const second = run(
    state,
    "docker build -t v2 .",
    dockerfile.replace("WORKDIR /app", "WORKDIR /code"),
  );
  assert.equal(second.ok, true);
  const a = state.images.at(-1).layers,
    b = second.state.images.at(-1).layers;
  assert.deepEqual(
    a.slice(0, 3).map((x) => x.id),
    b.slice(0, 3).map((x) => x.id),
  );
  assert.notEqual(a[3].id, b[3].id);
  assert.notEqual(a.at(-1).id, b.at(-1).id);
});

test("built images can run and containers retain immutable layer snapshots on rebuild", () => {
  let state = run(createInitialState(), "docker build -t campus-app .").state;
  state = run(state, "docker run campus-app").state;
  const oldLayer = state.containers[0].layers.at(-1).id;
  state = run(
    state,
    "docker build -t campus-app .",
    dockerfile.replace("echo ready", "echo updated"),
  ).state;
  assert.equal(state.containers[0].layers.at(-1).id, oldLayer);
  assert.notEqual(
    state.images.find((i) => i.name === "campus-app").layers.at(-1).id,
    oldLayer,
  );
});

test("docker history lists layer ids and instructions", () => {
  let state = run(createInitialState(), "docker build -t campus-app .").state;
  const result = run(state, "docker history campus-app");
  assert.equal(result.ok, true);
  assert.match(result.message, /COPY app.js \/app\//);
  assert.equal(result.message.split("\n").length, 7);
});

test("pull makes ordered base layers and second pull reuses image", () => {
  let result = run(createInitialState(), "docker pull alpine");
  assert.equal(result.ok, true);
  assert.equal(result.state.images[0].layers.length, 3);
  const next = run(result.state, "docker pull alpine");
  assert.deepEqual(next.steps, []);
  assert.strictEqual(next.state.images[0], result.state.images[0]);
});

test("Dockerfile syntax failures are atomic and do not pull base image", () => {
  const state = createInitialState();
  for (const invalid of [
    "",
    "RUN echo ready",
    "FROM ubuntu\nEXPOSE 3000",
    "FROM ubuntu\nFROM alpine",
    "FROM ubuntu\nCOPY ../secret /x",
    "FROM ubuntu\nWORKDIR relative",
    "FROM ubuntu\nCOPY only-one",
    "FROM ubuntu\nRUN " + "a".repeat(301),
    "FROM ubuntu\nRUN fine\nBADCOMMAND",
  ]) {
    const result = run(state, "docker build -t app .", invalid);
    assert.equal(result.ok, false, invalid);
    assert.strictEqual(result.state, state);
    assert.equal(state.images.length, 0);
  }
});

test("bad build invocations are rejected with zero state change", () => {
  const state = createInitialState();
  for (const command of [
    "docker build -t app",
    "docker build -t ../app .",
    "docker build app .",
    "docker build -t app /tmp",
    "docker build -t app . && rm -rf x",
  ]) {
    assert.strictEqual(run(state, command).state, state);
    assert.equal(run(state, command).ok, false);
  }
});

test("RUN instructions remain simulated text and are never executed", () => {
  const result = run(
    createInitialState(),
    "docker build -t app .",
    "FROM ubuntu\nRUN echo test; rm -rf /",
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.state.images.at(-1).layers.at(-1).instruction,
    "RUN echo test; rm -rf /",
  );
});
