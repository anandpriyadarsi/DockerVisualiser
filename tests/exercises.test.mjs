import test from "node:test";
import assert from "node:assert/strict";
import { runCommand } from "../src/simulator.js";
const api = await import("../src/exercises.js").catch(() => ({}));
const bridge = await import("../src/integration.js").catch(() => ({}));
test("fourteen scenarios complete by semantic results, accepting aliases", () => {
  assert.equal(Object.keys(api.EXERCISES || {}).length, 14);
  for (const [id, e] of Object.entries(api.EXERCISES)) {
    let session = api.createExercise(id);
    assert.equal(session.progress.complete, false, id);
    for (const cmd of e.solution) {
      const prior = session.state;
      let r = runCommand(prior, cmd, { confirmed: true });
      session = api.observeExercise(session, cmd, r, prior);
    }
    if (id === "m01.debug-exit")
      session = api.answerDiagnosis(session, "missing-executable");
    assert.equal(session.progress.complete, true, id);
  }
});
test("failed and wrong-effect operations cannot falsely advance; fixtures are separate", () => {
  assert.equal(typeof api.createExercise, "function");
  let a = api.createExercise("m01.stop-web");
  const prior = JSON.stringify(a);
  const r = runCommand(a.state, "docker stop missing");
  assert.deepEqual(
    api.observeExercise(a, "docker stop missing", r, a.state),
    a,
  );
  assert.equal(JSON.stringify(a), prior);
  const b = api.createExercise("m01.pull-nginx");
  assert.equal(b.state.images.length, 0);
  assert.equal(b.state.containers.length, 0);
});
test("strict launch and receipt protocol enforces pending context and consumes once", () => {
  assert.equal(typeof bridge.parseLaunch, "function");
  const request = {
    exercise: "m01.pull-nginx",
    lesson: "pull-run",
    returnLesson: "pull-run",
    attempt: "test_attempt_123",
    v: "1",
  };
  const url = bridge.launchUrl(request);
  const parsed = bridge.parseLaunch(new URL(url).search);
  assert.equal(parsed.exercise, request.exercise);
  const pending = {
    [request.attempt]: {
      exercise: request.exercise,
      lesson: request.lesson,
      v: 1,
    },
  };
  const receipt = bridge.parseRoute(
    new URL(bridge.returnUrl(parsed, true)).hash,
  );
  assert.equal(bridge.consumeReceipt(pending, receipt).accepted, true);
  assert.equal(bridge.consumeReceipt(pending, receipt).accepted, false);
  assert.equal(bridge.parseRoute("#%ZZ").lesson, "server");
});
test("tampering unknown versions external redirects oversized fields and stale receipts fail safely", () => {
  assert.equal(typeof bridge.parseLaunch, "function");
  for (const q of [
    "?v=99&exercise=m01.pull-nginx",
    "?v=1&exercise=unknown",
    "?v=1&exercise=m01.pull-nginx&returnUrl=https://evil.test",
    "?v=1&exercise=m01.pull-nginx&lesson=server&returnLesson=vm&attempt=12345678",
  ])
    assert.equal(bridge.parseLaunch(q).error !== undefined, true, q);
  assert.equal(
    bridge.consumeReceipt(
      {},
      {
        exercise: "m01.pull-nginx",
        attempt: "stale",
        result: "complete",
        lesson: "server",
        v: "1",
      },
    ).accepted,
    false,
  );
});
